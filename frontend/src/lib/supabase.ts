import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { BACKEND_URL } from '../config/app';

// Hardcoded fallback zodat het ook werkt als env vars leeg zijn in web build
const SUPABASE_URL_FALLBACK = 'https://kgiuavfvhtdgwuygbyzo.supabase.co';
const SUPABASE_ANON_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnaXVhdmZ2aHRkZ3d1eWdieXpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MzgzOTMsImV4cCI6MjA5MzAxNDM5M30.ezL6iv8bSXM4ZNZwtiesYdgiirUPKzh3fhu18HvLMpc';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || SUPABASE_URL_FALLBACK;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_FALLBACK;

export const isSupabaseConfigured = () =>
  Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export { BACKEND_URL };
