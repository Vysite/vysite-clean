import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';

const env = readFileSync('/tmp/cc-agent/67115248/project/.env', 'utf8');
const getUrl = env.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const getKey = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const sb = createClient(getUrl, getKey);

const PID = 'p-test-commercial-recon';
const { data: proj } = await sb.from('vy_projects').select('*').eq('id', PID).single();
const { data: wb } = await sb.from('vy_valuation_workbooks').select('*').eq('project_id', PID).single();
const { data: wbLines } = await sb.from('vy_workbook_lines').select('*').eq('workbook_id', wb.id);
const { data: wbExtras } = await sb.from('vy_workbook_extras').select('*').eq('workbook_id', wb.id);
const { data: valuations } = await sb.from('vy_valuations').select('*').eq('project_id', PID);
const { data: vLE } = await sb.from('vy_valuation_line_entries').select('*');
const { data: vEE } = await sb.from('vy_valuation_extra_entries').select('*');
const { data: apps } = await sb.from('vy_commercial_applications').select('*').eq('project_id', PID);
const { data: vaItems } = await sb.from('vy_variation_account').select('*').eq('project_id', PID);
const { data: records } = await sb.from('vy_commercial_records').select('*').eq('project_id', PID);
const { data: keyDates } = await sb.from('vy_key_dates').select('*').eq('project_id', PID);

globalThis.__TEST_DATA = { proj, wb, wbLines, wbExtras, valuations, vLE, vEE, apps, vaItems, records, keyDates };
writeFileSync('/tmp/test-data.json', JSON.stringify(globalThis.__TEST_DATA));
console.log('data loaded:', { lines: wbLines.length, extras: wbExtras.length, vals: valuations.length, apps: apps.length, va: vaItems.length, recs: records.length });
