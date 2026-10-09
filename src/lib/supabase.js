import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(SUPABASE_URL && anonKey);

export const supabase = createClient(SUPABASE_URL || 'http://localhost:54321', anonKey || 'missing-anon-key');

export const functionUrl = (name) => `${SUPABASE_URL}/functions/v1/${name}`;
