import { createClient } from '@supabase/supabase-js';
import { env } from './env';

if (!env.supabaseUrl || !env.supabaseAnonKey) {
  document.body.innerHTML = `
    <div style="min-height:100vh;background:#111827;display:flex;align-items:center;justify-content:center;font-family:sans-serif;padding:24px">
      <div style="max-width:480px;background:#1e2533;border-radius:16px;padding:40px;border:1px solid #7f1d1d;text-align:center">
        <div style="width:56px;height:56px;background:#450a0a;border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:24px;color:#f87171;font-weight:bold">!</div>
        <h1 style="color:#fff;font-size:20px;margin:0 0 8px">Configuration error</h1>
        <p style="color:#94a3b8;font-size:14px;margin:0 0 16px">VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set.</p>
        <p style="color:#64748b;font-size:12px;margin:0">Add these environment variables in your Vercel project settings and redeploy.</p>
      </div>
    </div>`;
  throw new Error('Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.');
}

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
