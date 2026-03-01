import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient<any>(url, anonKey) : null;

if (import.meta.env.DEV && url) {
  const projectRef = url.replace(/^https:\/\//, '').replace(/\.supabase\.co.*/, '');
  console.info('[Supabase] project ref:', projectRef, '(verify matches Vercel env VITE_SUPABASE_URL)');
}

