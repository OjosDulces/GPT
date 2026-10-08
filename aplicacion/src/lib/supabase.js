import { createClient } from '@supabase/supabase-js';
const config = globalThis.window?.APP_CONFIG || {};
export const supabaseUrl = String(config.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '').trim();
export const supabaseAnonKey = String(config.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
let validUrl = false;
try { const url = new URL(supabaseUrl); validUrl = ['https:', 'http:'].includes(url.protocol) && !/TU-PROYECTO|\.\.\./i.test(url.hostname); } catch { /* Configuration screen handles missing data. */ }
export const isSupabaseConfigured = Boolean(validUrl && supabaseAnonKey && !/TU_CLAVE|TU-PROYECTO/i.test(supabaseAnonKey));
const demo = import.meta.env.VITE_DESKTOP === 'true' || import.meta.env.VITE_DEMO_ONLY === 'true' || new URLSearchParams(globalThis.window?.location.search || '').get('demo') === '1';
const publicCatalogRoute = globalThis.window?.location.pathname.startsWith('/catalogo/');
export const supabase = isSupabaseConfigured && !demo && !publicCatalogRoute ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
