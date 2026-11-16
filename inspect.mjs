import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = readFileSync('.env', 'utf8');
const getUrl = env.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const getKey = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const sb = createClient(getUrl, getKey);
const PID = 'p-test-commercial-recon';
const { data: proj } = await sb.from('vy_projects').select('*').eq('id', PID).single();
console.log('proj keys:', Object.keys(proj).join(','));
for (const t of ['vy_valuations','vy_commercial_applications']) {
  const { data, error } = await sb.from(t).select('*').eq('project_id', PID);
  console.log(t, error ? 'ERR '+error.message : `count=${data.length}`, error ? '' : Object.keys(data[0]||{}).join(','));
}
