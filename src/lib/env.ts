// Environment configuration — single source of truth for all env-dependent values.
// Import this module anywhere env values are needed instead of reading
// import.meta.env directly, so all access is typed and validated in one place.

declare const __APP_ENV__: string;
declare const __APP_VERSION__: string;

export type AppEnv = 'development' | 'staging' | 'production';

function resolveEnv(): AppEnv {
  const raw = (import.meta.env.VITE_APP_ENV ?? __APP_ENV__ ?? 'development').toLowerCase();
  if (raw === 'staging') return 'staging';
  if (raw === 'production') return 'production';
  return 'development';
}

export const env = {
  /** Which environment this build is running in. */
  appEnv: resolveEnv(),

  /** Public URL for this environment (no trailing slash). */
  appUrl: (import.meta.env.VITE_APP_URL as string | undefined) ?? 'http://localhost:5173',

  /** Semantic version string for this build. */
  version: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? __APP_VERSION__ ?? '0.0.0',

  /** Supabase project URL. */
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,

  /** Supabase public anon key. */
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,

  /** Whether AI features are enabled for this environment. */
  aiEnabled: import.meta.env.VITE_ENABLE_AI !== 'false',

  // Derived booleans for convenience.
  isDevelopment: resolveEnv() === 'development',
  isStaging: resolveEnv() === 'staging',
  isProduction: resolveEnv() === 'production',
} as const;
