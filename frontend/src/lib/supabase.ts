import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BACKEND_URL } from '../config/app';

const SUPABASE_URL_FALLBACK = 'https://kgiuavfvhtdgwuygbyzo.supabase.co';
const SUPABASE_ANON_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnaXVhdmZ2aHRkZ3d1eWdieXpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MzgzOTMsImV4cCI6MjA5MzAxNDM5M30.ezL6iv8bSXM4ZNZwtiesYdgiirUPKzh3fhu18HvLMpc';

let supabaseInstance: SupabaseClient | null = null;

export const initSupabase = (url: string, key: string) => {
  supabaseInstance = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return supabaseInstance;
};

export const supabase = new Proxy({} as SupabaseClient, {
  get: (target, prop) => {
    if (!supabaseInstance) {
      console.warn("⚠️ Supabase client niet dynamisch ingesteld! Terugval op .env");
      const url = process.env.EXPO_PUBLIC_SUPABASE_URL || SUPABASE_URL_FALLBACK;
      const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_FALLBACK;
      supabaseInstance = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: true },
      });
    }
    return (supabaseInstance as any)[prop];
  }
});

export const isSupabaseConfigured = () => Boolean(supabaseInstance);

export { BACKEND_URL };
