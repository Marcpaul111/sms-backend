import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const normalizeBaseUrl = (u?: string) => {
  if (!u) return undefined;
  return u.replace(/\/rest\/v1$/i, '').replace(/\/storage\/v1\/s3$/i, '');
};

const SUPABASE_URL = normalizeBaseUrl(rawUrl);

export const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;
