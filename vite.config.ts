import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables for the current mode so build scripts can use them.
  // vite build --mode staging  → loads .env.staging
  // vite build --mode production → loads .env.production
  // vite dev (default)         → loads .env.development
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    define: {
      // Injected at build time — accessible as global constants in source code.
      __APP_VERSION__: JSON.stringify(env.VITE_APP_VERSION ?? '0.0.0'),
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV ?? mode),
    },
  };
});
