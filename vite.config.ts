import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],
      // ExcelJS needs Buffer to be available in the browser bundle
      include: ['buffer'],
    },
    define: {
      __APP_VERSION__: JSON.stringify(env.VITE_APP_VERSION ?? '0.0.0'),
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV ?? mode),
      // ExcelJS accesses process.env at runtime; provide a stub
      'process.env': {},
    },
    resolve: {
      alias: {
        // Polyfill the Node.js Buffer global for ExcelJS in browser
        buffer: 'buffer/',
      },
    },
  };
});
