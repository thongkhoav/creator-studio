import { createClient } from '@supabase/supabase-js';

const runtime = globalThis.__CONTENT_CONFIG__ || {};
const url = runtime.supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
const key = runtime.supabasePublishableKey || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabaseConfigured = Boolean(url && key);
export const supabase = supabaseConfigured ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;

export async function apiFetch(path, options = {}, workspaceId) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in required.');
  return fetch(path, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${session.access_token}`, ...(workspaceId ? { 'X-Workspace-ID': workspaceId } : {}) } });
}
